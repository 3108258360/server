import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './user.entity';
import { Page } from './page.entity';
import { JwtStrategy } from './jwt.strategy';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppConfig } from './config/app.config';
import * as path from 'path';
import * as mysql from 'mysql2/promise';
import { DataSource, DataSourceOptions } from 'typeorm';

const dbConfig = AppConfig.database;

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: path.resolve(process.cwd(), 'static'),
    }),
    PassportModule,
    JwtModule.register({
      secret: AppConfig.jwt.secret,
      signOptions: { expiresIn: AppConfig.jwt.expiresIn },
    }),
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        const connection = await mysql.createConnection({
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.username,
          password: dbConfig.password,
        });
        await connection.query(
          `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
        );
        await connection.end();
        
        const dataSourceOptions: DataSourceOptions = {
          ...dbConfig,
          entities: [User, Page],
          synchronize: false,
        };

        // 在非生产环境下，如果数据库没有表，则自动同步一次
        if (process.env.NODE_ENV !== 'production') {
          const checkDataSource = new DataSource({ ...dataSourceOptions });
          await checkDataSource.initialize();
          const hasTables = (await checkDataSource.query('SHOW TABLES')).length > 0;
          await checkDataSource.destroy();

          if (!hasTables) {
            console.log(
              '数据库中没有检测到表，将执行首次自动同步...',
            );
            return {
              ...dataSourceOptions,
              synchronize: true, // 临时开启同步
            };
          }
        }
        
        return dataSourceOptions;
      },
    }),
    TypeOrmModule.forFeature([User, Page]),
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule {}
