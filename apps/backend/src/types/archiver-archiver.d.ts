declare module "@archiver/archiver" {
  import type { Readable, PassThrough } from "node:stream";

  interface EntryData {
    name: string;
    date?: Date | string;
    mode?: number;
  }

  interface ZipOptions {
    zlib?: { level?: number };
  }

  class Archiver extends PassThrough {
    append(source: Buffer | Readable | string, data: EntryData): this;
    file(filepath: string, data: EntryData): this;
    finalize(): Promise<void>;
    pointer(): number;
  }

  class ZipArchive extends Archiver {
    constructor(options?: ZipOptions);
  }

  export { Archiver, ZipArchive };
}
