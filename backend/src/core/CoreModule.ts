import { Module, Global } from '@nestjs/common';
import { ModuleLoader } from './ModuleLoader';
// import { CoreContext } from './context/CoreContext';

@Global()
@Module({
    providers: [
        ModuleLoader,
        // CoreContext
    ],
    exports: [
        ModuleLoader,
        // CoreContext
    ],
})
export class CoreModule { }
