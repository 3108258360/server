import {
  Controller,
  Get,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Query,
  Param,
  UseGuards,
  Request,
  Put,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { AppService } from './app.service';
import { CharacterDto, ProfileDto, ContentDto } from './character.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AppConfig } from './config/app.config';

// 处理中文文件名的函数
export function sanitizeFilename(filename: string): string {
  try {
    // 调试信息

    // 方法1: 尝试URL解码
    if (filename.includes('%')) {
      const decoded = decodeURIComponent(filename);
      return decoded;
    }

    // 方法2: 尝试Buffer解码（处理latin1编码）
    const buffer = Buffer.from(filename, 'latin1');
    const utf8String = buffer.toString('utf8');

    // 检查解码后的字符串是否包含中文字符
    if (/[\u4e00-\u9fff]/.test(utf8String)) {
      return utf8String;
    }

    // 方法3: 尝试从Buffer直接转换（处理其他编码）
    const bytes = Buffer.from(filename, 'binary');
    const decoded = bytes.toString('utf8');

    // 检查是否包含中文字符
    if (/[\u4e00-\u9fff]/.test(decoded)) {
      return decoded;
    }
    return filename;
  } catch (error) {
    return filename;
  }
}

// 图片文件上传配置
const uploadConfig = {
  storage: diskStorage({
    destination: AppConfig.upload.destination,
    filename: (req, file, cb) => {
      // 使用处理过的文件名
      return cb(null, sanitizeFilename(file.originalname));
    },
  }),
  limits: {
    fileSize: AppConfig.upload.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    if (AppConfig.upload.allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'), false);
    }
  },
};

// 通用文件上传配置（支持所有文件类型，几乎无限制）
const fileUploadConfig = {
  storage: diskStorage({
    destination: AppConfig.upload.destination,
    filename: (req, file, cb) => {
      // 使用处理过的文件名
      return cb(null, sanitizeFilename(file.originalname));
    },
  }),
  limits: {
    fileSize: AppConfig.otherFileUpload.maxFileSize, // 使用其他文件的限制
    files: AppConfig.otherFileUpload.maxFiles, // 使用其他文件的限制
  },
  fileFilter: (req, file, cb) => {
    // 允许所有文件类型
    cb(null, true);
  },
};

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('')
  getStatus() {
    return {
      message: '服务器已运行',
      port: AppConfig.server.port,
      time: new Date().toISOString(),
    };
  }

  @Post('page')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', AppConfig.upload.maxFiles, fileUploadConfig),
  )
  async page(
    @UploadedFiles() files: any[],
    @Body() body: any,
    @Request() req: any,
  ) {
    const route = req.headers.route;
    const username = req.user?.username;

    // 验证必要参数
    if (!route) {
      return { message: '缺少 route 参数' };
    }

    // data参数变为可选，如果没有提供data或data为空，则设为null
    let parsedData = null;
    if (body.data) {
      try {
        parsedData = JSON.parse(body.data);
      } catch (error) {
        return { message: 'data 参数格式错误，必须是有效的 JSON 字符串' };
      }
    }

    return await this.appService.saveCharacterPage(
      route,
      files || [],
      parsedData,
      username,
    );
  }

  @Post('register')
  async register(
    @Body() body: { username: string; password: string; email: string },
  ) {
    return await this.appService.register(
      body.username,
      body.password,
      body.email,
    );
  }

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    return await this.appService.login(body.username, body.password);
  }

  @Post('reset')
  async reset(
    @Body() body: { username: string; email: string; password: string },
  ) {
    return await this.appService.resetPassword(
      body.username,
      body.email,
      body.password,
    );
  }

  @Get('page')
  async getPage(@Request() req: any) {
    const route = req.headers.route;
    return await this.appService.getPage(route);
  }

  @Get('character/:character')
  async getCharacter(@Param('character') character: string) {
    const route = `/character/${character}`;
    return await this.appService.getPage(route);
  }

  @Get('user/info')
  @UseGuards(JwtAuthGuard)
  async getUserInfo(@Request() req: any) {
    const username = req.user?.username;
    return await this.appService.getUserInfo(username);
  }

  @Post('admin')
  async adminLogin(@Body() body: { username: string; password: string }) {
    return await this.appService.adminLogin(body.username, body.password);
  }

  // 单个用户权限开关
  @Put('user/permission')
  async updateUserPermission(
    @Body() body: { username: string; editPermission: number },
  ) {
    return await this.appService.updateUserPermission(
      body.username,
      body.editPermission,
    );
  }
}
