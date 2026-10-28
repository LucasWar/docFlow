import {
  DocumentFindManyArgs,
  DocumentWhereInput,
} from 'src/generated/prisma/models';
import { DocumentFilter } from './type/filter-document.type';

export class BuilderFilterDocuments {
  constructor(
    private readonly filters: DocumentFilter,
    private readonly userId: string,
  ) {}

  private where: DocumentWhereInput = {};
  private skip?: number;
  private take?: number;

  public build(): DocumentFindManyArgs {
    this.withPagination();
    this.withFileName();
    this.withStatus();

    this.where.userId = {
      equals: this.userId,
    };

    return {
      where: this.where,
      skip: this.skip,
      take: this.take,
    };
  }

  private withPagination(): this {
    if (this.filters.page && this.filters.limit) {
      const page = Number(this.filters.page);
      const limit = Number(this.filters.limit);

      this.skip = (page - 1) * limit;
      this.take = limit;
    }

    return this;
  }

  // private withSorting(): this {
  //   if (this.filters.sortBy) {
  //     this.orderBy = {
  //       [this.filters.sortBy]: this.filters.sort ?? 'asc',
  //     };
  //   }
  //   return this;
  // }

  private withFileName(): this {
    if (this.filters.fileName) {
      this.where.fileName = {
        contains: this.filters.fileName,
        mode: 'insensitive',
      };
    }
    return this;
  }

  private withStatus(): this {
    if (this.filters.status) {
      this.where.status = {
        equals: this.filters.status,
      };
    }
    return this;
  }
}
