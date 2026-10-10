import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { AuthenticateGuard } from 'src/shared/guards/auth.guard';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseGuards(AuthenticateGuard)
  create(
    @Body() createDocumentDto: CreateDocumentDto,
    @CurrentUser() userId: string,
  ) {
    return this.documentsService.upload(createDocumentDto, userId);
  }

  @Get()
  @UseGuards(AuthenticateGuard)
  listDocuments(@CurrentUser() userId: string, @Query() filters: any) {
    return this.documentsService.listDocuments(userId);
  }

  @Get(':id')
  @UseGuards(AuthenticateGuard)
  findDocument(@CurrentUser() userId: string, @Param('id') documentId: string) {
    return this.documentsService.findDocument(userId, documentId);
  }

  @Post('search')
  @UseGuards(AuthenticateGuard)
  search(
    @CurrentUser() userId: string,
    @Body('searchText') searchText: string,
  ) {
    return this.documentsService.search(userId, searchText);
  }

  // @Get('listdocuemnts/pages/:id')
  // @UseGuards(AuthenticateGuard)
  // findManyPages(@CurrentUser() userId: string) {
  //   return this.documentsService.upload(userId);
  // }
}
