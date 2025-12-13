import { Module } from '@nestjs/common';
import { ModeloModelController } from './controllers/modelo-model.controller';
import { ModeloModelService } from './services/modelo-model.service';

@Module({
    controllers: [ModeloModelController],
    providers: [ModeloModelService],
    exports: [ModeloModelService],
})
export class ModeloModelModule { }
