export const AppConfig = {
  // 服务器端口配置，需要与前端的服务器地址一致
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
  },
  // 跨域配置，允许所有域名访问
  cors: {
    origin: true,
    credentials: true,
  },
  // 数据库配置，需要与你设置的用户名、密码一致
  database: {
    type: 'mysql' as const,
    host: 'localhost',
    port: 3306,
    username: 'root', // 用户名
    password: '123456', // 密码
    database: 'skullgirls',
    synchronize: true,
  },
  // 管理员配置
  admin: {
    username: 'admin',
    password: 'admin',
  },

  // JWT配置
  jwt: {
    secret: '十年之约',
    expiresIn: '1y',
  },
  // 文件上传配置
  upload: {
    destination: './static/',
    maxFileSize: 99 * 1024 * 1024 * 1024, // 99GB
    maxFiles: 999, // 999个文件
    allowedMimes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/tiff',
      'image/tif',
      'image/avif',
      'image/heic',
      'image/heif',
    ],
  },
  otherFileUpload: {
    maxFileSize: 99 * 1024 * 1024 * 1024, // 99GB for other files
    maxFiles: 999, // 999 files for other files
  },
  // 图片压缩配置
  imageCompression: {
    maxWidth: 200,
    quality: 80,
    formats: {
      png: {
        quality: 80,
        compressionLevel: 9,
      },
      jpeg: {
        quality: 80,
        progressive: true,
        mozjpeg: true,
      },
      webp: {
        quality: 80,
        effort: 6,
      },
      tiff: {
        quality: 80,
        compression: 'lzw',
      },
      avif: {
        quality: 80,
        effort: 6,
      },
      heif: {
        quality: 80,
        effort: 6,
      },
    },
  },

  // 静态文件配置
  static: {
    rootPath: './static',
  },

  // 权限配置
  permissions: {
    editPermission: {
      disabled: 0,
      enabled: 1,
    },
  },
};
