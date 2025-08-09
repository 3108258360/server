import { IsString, IsArray, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BasicInfoDto {
  @IsString()
  label: string;
  
  @IsString()
  value: string;
}

export class ContentItemDto {
  @IsEnum(['p', 'img', 'h2', 'h3'])
  type: 'p' | 'img' | 'h2' | 'h3';
  
  @IsOptional()
  @IsString()
  text?: string;
  
  @IsOptional()
  @IsString()
  src?: string;
}

export class ProfileDto {
  @IsEnum(['profile'])
  type: 'profile';
  
  @IsString()
  title: string;
  
  @IsString()
  portraitImg: string;
  
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BasicInfoDto)
  basicInfo: BasicInfoDto[];
}

export class ContentDto {
  @IsEnum(['content'])
  type: 'content';
  
  @IsString()
  title: string;
  
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentItemDto)
  content: ContentItemDto[];
}

// 联合类型，可以是ProfileDto或ContentDto
export type CharacterDto = ProfileDto | ContentDto; 