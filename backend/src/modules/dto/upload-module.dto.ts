export class UploadModuleDto {
  name: string;
  displayName: string;
  description?: string;
  version: string;
  dependencies?: string[];
  migrations?: string[];
  config?: any;
}