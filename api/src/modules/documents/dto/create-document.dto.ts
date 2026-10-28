import {
  Equals,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsNumber()
  @Max(20 * 1024 * 1024)
  @Min(0)
  @IsNotEmpty()
  size!: number;

  @Equals('pdf', {
    message: 'Arquivo deve ter formato pdf',
  })
  @IsNotEmpty()
  type!: string;
}
