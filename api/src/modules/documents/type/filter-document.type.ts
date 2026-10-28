import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { StatusDocument } from 'src/generated/prisma/enums';

export class DocumentFilter {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit: number = 12;

  @IsOptional()
  @IsString()
  fileName: string = '';

  @IsOptional()
  @IsDateString()
  createdAt?: Date;

  @IsOptional()
  @IsEnum(StatusDocument)
  status?: StatusDocument;
}
