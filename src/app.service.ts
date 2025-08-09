import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from './user.entity';
import { HashUtil } from './hash.util';
import { Page } from './page.entity';
import * as sharp from 'sharp';
import * as fs from 'fs';
import { extname } from 'path';
import { AppConfig } from './config/app.config';
import { sanitizeFilename } from './app.controller';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Page)
    private readonly pageRepository: Repository<Page>,
    private jwtService: JwtService,
  ) {}

  async register(username: string, password: string, email: string) {
    const existingUser = await this.userRepository.findOne({
      where: { username },
    });
    if (existingUser) {
      return { message: '用户名已存在' };
    }

    const salt = await HashUtil.genSalt();
    const emailSalt = await HashUtil.genSalt();
    const hashedPassword = await HashUtil.hashPassword(password, salt);
    const hashedEmail = await HashUtil.hashEmail(email, emailSalt);

    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      email: hashedEmail,
      salt,
      emailSalt,
      registerTime: new Date(),
      editPermission: 1, // 默认有编辑权限
      editCount: 0,
      loginCount: 0,
      resetPasswordCount: 0,
    });

    await this.userRepository.save(user);
    return { message: '注册成功' };
  }

  async login(username: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { username },
    });
    if (!user) {
      return { message: '用户名不存在' };
    }

    const hash = await HashUtil.hashPassword(password, user.salt);
    if (hash !== user.password) {
      // 登录失败，记录失败次数
      user.loginCount += 1;
      await this.userRepository.save(user);
      return { message: '密码错误' };
    }

    // 登录成功，更新登录次数
    user.loginCount += 1;
    await this.userRepository.save(user);

    // 生成JWT token
    const payload = { username: user.username };
    const token = this.jwtService.sign(payload);

    return {
      message: '登录成功',
      username: user.username,
      authorization: token,
      loginCount: user.loginCount,
      editPermission: user.editPermission,
    };
  }

  async resetPassword(username: string, email: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { username },
    });
    if (!user) {
      return { message: '用户不存在' };
    }

    const emailMatch = await HashUtil.compareEmail(
      email,
      user.email,
      user.emailSalt,
    );
    if (!emailMatch) {
      // 重置失败，记录失败次数
      user.resetPasswordCount += 1;
      await this.userRepository.save(user);
      return { message: '邮箱错误' };
    }

    const newSalt = await HashUtil.genSalt();
    const newHash = await HashUtil.hashPassword(password, newSalt);
    user.password = newHash;
    user.salt = newSalt;
    user.resetPasswordCount += 1;

    await this.userRepository.save(user);
    return { message: '密码重置成功' };
  }

  async savePage(route: string, data: any) {
    let page = await this.pageRepository.findOne({ where: { route } });
    if (!page) {
      page = this.pageRepository.create({ route, data: JSON.stringify(data) });
    } else {
      page.data = JSON.stringify(data);
    }
    await this.pageRepository.save(page);
    return page;
  }

  async getPage(route: string) {
    const page = await this.pageRepository.findOne({ where: { route } });
    if (!page) return { data: [] };
    return { ...page, data: JSON.parse(page.data) };
  }

  async saveCharacterPage(
    route: string,
    files: any[],
    data: any,
    username?: string,
  ) {
    // 检查编辑权限 - 必须提供用户名
    if (!username) {
      return { message: '用户未登录，无法编辑' };
    }

    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      return { message: '用户不存在' };
    }

    if (user.editPermission !== AppConfig.permissions.editPermission.enabled) {
      return { message: '您没有编辑权限' };
    }

    // 更新编辑记录
    user.lastEditTime = new Date();
    user.editCount += 1;
    await this.userRepository.save(user);

    // 处理上传的文件
    const uploadedFiles = files || [];
    const imageFiles: any[] = [];
    const otherFiles: any[] = [];

    // 分离图片文件和其他文件
    for (const file of uploadedFiles) {
      if (AppConfig.upload.allowedMimes.includes(file.mimetype)) {
        // 图片文件，需要压缩
        imageFiles.push(file);
        await this.createCompressedImage(file.path, file.originalname);
      } else {
        // 其他文件，不压缩
        otherFiles.push(file);
      }
    }

    // 只有当data存在时才处理数据并写入数据库
    if (data) {
      // 更新数据中的图片路径
      const characterData = Array.isArray(data) ? data : [data];

      characterData.forEach((character, blockIndex) => {
        if (this.isProfileDto(character)) {
          const profileFile = imageFiles.find((file) =>
            file.originalname.startsWith(`profile_${blockIndex}_`),
          );
          if (profileFile) {
            character.portraitImg = `/static/${profileFile.originalname}`;
          }
        } else if (
          this.isContentDto(character) &&
          character.content &&
          Array.isArray(character.content)
        ) {
          character.content.forEach((content, contentIndex) => {
            if (content && content.type === 'img') {
              const contentFile = imageFiles.find((file) =>
                file.originalname.startsWith(
                  `content_${blockIndex}_${contentIndex}_`,
                ),
              );
              if (contentFile) {
                content.src = `/static/${contentFile.originalname}`;
              }
            }
          });
        }
      });

      // 保存到page表
      await this.savePage(route, characterData);
      return { message: '数据保存成功' };
    } else {
      // 没有data，仅处理文件上传
      return { message: '文件上传成功' };
    }
  }

  // 创建压缩图片的函数
  async createCompressedImage(
    filePath: string,
    fileName: string,
  ): Promise<string> {
    const ext = extname(fileName).toLowerCase();
    const nameWithoutExt = fileName.replace(ext, '');
    // 先对原始文件名解码
    const safeNameWithoutExt = sanitizeFilename(nameWithoutExt);
    const compressedFileName = `${safeNameWithoutExt}_Min${ext}`; // 保持原扩展名
    const safeCompressedFileName = sanitizeFilename(compressedFileName);
    const compressedFilePath = `./static/${safeCompressedFileName}`;

    try {
      let sharpInstance = sharp(filePath);

      // 根据原文件格式进行预处理和压缩
      switch (ext) {
        case '.png':
          await sharpInstance
            .resize(AppConfig.imageCompression.maxWidth, null, {
              withoutEnlargement: true,
              fit: 'inside',
            })
            .png(AppConfig.imageCompression.formats.png)
            .toFile(compressedFilePath);
          break;
        case '.gif':
          await sharpInstance
            .resize(AppConfig.imageCompression.maxWidth, null, {
              withoutEnlargement: true,
              fit: 'inside',
            })
            .gif()
            .toFile(compressedFilePath);
          break;
        case '.webp':
          await sharpInstance
            .resize(AppConfig.imageCompression.maxWidth, null, {
              withoutEnlargement: true,
              fit: 'inside',
            })
            .webp(AppConfig.imageCompression.formats.webp)
            .toFile(compressedFilePath);
          break;
        case '.tiff':
        case '.tif':
          await sharpInstance
            .resize(AppConfig.imageCompression.maxWidth, null, {
              withoutEnlargement: true,
              fit: 'inside',
            })
            .tiff(AppConfig.imageCompression.formats.tiff)
            .toFile(compressedFilePath);
          break;
        case '.avif':
          await sharpInstance
            .resize(AppConfig.imageCompression.maxWidth, null, {
              withoutEnlargement: true,
              fit: 'inside',
            })
            .avif(AppConfig.imageCompression.formats.avif)
            .toFile(compressedFilePath);
          break;
        case '.heic':
        case '.heif':
          await sharpInstance
            .resize(AppConfig.imageCompression.maxWidth, null, {
              withoutEnlargement: true,
              fit: 'inside',
            })
            .heif(AppConfig.imageCompression.formats.heif)
            .toFile(compressedFilePath);
          break;
        default:
          // JPEG格式
          await sharpInstance
            .resize(AppConfig.imageCompression.maxWidth, null, {
              withoutEnlargement: true,
              fit: 'inside',
            })
            .jpeg(AppConfig.imageCompression.formats.jpeg)
            .toFile(compressedFilePath);
          break;
      }

      return safeCompressedFileName;
    } catch (error) {
      console.error('压缩图片失败:', error);
      return fileName; // 如果压缩失败，返回原文件名
    }
  }

  // 类型守卫
  private isProfileDto(character: any): boolean {
    return character.type === 'profile';
  }
  private isContentDto(character: any): boolean {
    return character.type === 'content';
  }

  // 获取用户信息
  async getUserInfo(username: string) {
    const user = await this.userRepository.findOne({
      where: { username },
    });
    if (!user) {
      return { message: '用户不存在' };
    }
    return { message: '获取用户信息成功' };
  }

  // 单个用户权限开关
  async updateUserPermission(username: string, editPermission: number) {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (!user) {
      return { message: '用户不存在' };
    }

    user.editPermission = editPermission;
    await this.userRepository.save(user);

    const status =
      editPermission === AppConfig.permissions.editPermission.enabled
        ? '启用'
        : '禁用';
    return { message: `用户 ${username} 编辑权限已${status}` };
  }

  // 超级用户登录
  async adminLogin(username: string, password: string) {
    if (username !== AppConfig.admin.username) {
      return { message: '超级用户账号错误' };
    }

    if (password !== AppConfig.admin.password) {
      return { message: '超级用户密码错误' };
    }

    // 从用户表中查询admin用户信息
    const adminUser = await this.userRepository.findOne({
      where: { username: AppConfig.admin.username },
    });

    if (!adminUser) {
      return { message: '管理员用户不存在' };
    }

    // 获取所有用户信息
    const allUsers = await this.userRepository.find({
      select: [
        'username',
        'lastEditTime',
        'editCount',
        'editPermission',
        'registerTime',
      ],
    });

    // 格式化用户数据
    const usersData = allUsers.map((user) => ({
      username: user.username,
      lastEditTime: user.lastEditTime,
      editCount: user.editCount,
      editPermission: user.editPermission,
      registerTime: user.registerTime,
    }));

    return {
      message: '超级用户登录成功',
      data: usersData,
    };
  }
}
