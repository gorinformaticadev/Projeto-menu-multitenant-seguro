import { Injectable } from '@nestjs/common';
import { DockerUpdateRuntimeAdapter } from './docker-update-runtime.adapter';
import { NativeUpdateRuntimeAdapter } from './native-update-runtime.adapter';
import type { UpdateExecutionMode } from '../update-execution.types';
import type { UpdateRuntimeAdapterDescriptor } from './update-runtime-adapter.interface';

@Injectable()
export class UpdateRuntimeAdapterRegistryService {
  constructor(
    private readonly nativeAdapter: NativeUpdateRuntimeAdapter,
    private readonly dockerAdapter: DockerUpdateRuntimeAdapter,
  ) {}

  list(): UpdateRuntimeAdapterDescriptor[] {
    return [this.nativeAdapter.describe(), this.dockerAdapter.describe()];
  }

  get(mode: UpdateExecutionMode): UpdateRuntimeAdapterDescriptor {
    return mode === 'docker' ? this.dockerAdapter.describe() : this.nativeAdapter.describe();
  }
}
