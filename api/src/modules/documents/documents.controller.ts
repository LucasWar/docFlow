import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { AuthenticateGuard } from 'src/shared/guards/auth.guard';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentFilter } from './type/filter-document.type';

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
  listDocuments(
    @CurrentUser() userId: string,
    @Query() filters: DocumentFilter,
  ) {
    return this.documentsService.listDocuments(filters, userId);
  }

  @Get('resume')
  @UseGuards(AuthenticateGuard)
  resume(@CurrentUser() userId: string) {
    return this.documentsService.resume(userId);
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

  @Delete(':id')
  @UseGuards(AuthenticateGuard)
  deleteDocument(
    @CurrentUser() userId: string,
    @Param('id') documentId: string,
  ) {
    return this.documentsService.deleteDocument(userId, documentId);
  }

  @Get(':id/download')
  @UseGuards(AuthenticateGuard)
  downloadDocument(
    @CurrentUser() userId: string,
    @Param('id') documentId: string,
  ) {
    return this.documentsService.downloadDocument(userId, documentId);
  }

  // @Get('listdocuemnts/pages/:id')
  // @UseGuards(AuthenticateGuard)
  // findManyPages(@CurrentUser() userId: string) {
  //   return this.documentsService.upload(userId);
  // }
}
