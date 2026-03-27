const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const expectContains = (source, fragment, description) => {
  if (!source.includes(fragment)) {
    throw new Error(`Missing: ${description}\nFragment: ${fragment}`);
  }
};

const expectRegex = (source, regex, description) => {
  if (!regex.test(source)) {
    throw new Error(`Missing pattern: ${description}\nRegex: ${regex}`);
  }
};

const installMain = read('install/install.sh');
const install2NativeUtils = read('install-2/utils/native-utils.sh');
const install2Docker = read('install-2/utils/docker-install.sh');
const updateScript = read('install/update.sh');

expectContains(
  installMain,
  'resolve_redis_password_for_install()',
  'installer must centralize redis password resolution',
);
expectContains(
  installMain,
  'read_native_redis_password_from_conf()',
  'installer must support redis.conf as native source of truth',
);
expectContains(
  installMain,
  'native_configure_redis_auth()',
  'installer must configure redis requirepass in native mode',
);
expectContains(
  installMain,
  'native_validate_redis_auth()',
  'installer must validate redis auth using redis-cli -a',
);
expectContains(
  installMain,
  'native_validate_backend_shared_storage()',
  'installer must validate backend shared storage in native mode',
);
expectContains(
  installMain,
  'validate_docker_shared_storage_stack()',
  'installer must validate docker redis + backend shared storage',
);
expectRegex(
  installMain,
  /pm2 restart '[^']+-backend' '[^']+-frontend' --update-env/,
  'native pm2 restart must use --update-env',
);
expectRegex(
  installMain,
  /pm2 start dist\/main\.js --name '[^']+-backend'(?: [^"'&|]+|'[^']*'|"[^"]*")* --update-env/,
  'native pm2 start must use --update-env',
);

expectContains(
  install2NativeUtils,
  'resolve_redis_password_native()',
  'install-2 native flow must resolve redis password idempotently',
);
expectContains(
  install2NativeUtils,
  'configure_redis_auth_native()',
  'install-2 native flow must configure redis auth',
);
expectContains(
  install2NativeUtils,
  'validate_backend_shared_storage_native()',
  'install-2 native flow must validate backend shared storage',
);
expectRegex(
  install2NativeUtils,
  /pm2 start ecosystem\.config\.js --update-env/,
  'install-2 PM2 start must use --update-env',
);
expectContains(
  install2NativeUtils,
  'upsert_env "REDIS_PASSWORD" "$redis_pass" "$env_file"',
  'backend env must receive REDIS_PASSWORD in install-2 native flow',
);

expectContains(
  install2Docker,
  'resolve_docker_redis_password()',
  'install-2 docker flow must resolve redis password idempotently',
);
expectContains(
  install2Docker,
  'validate_docker_shared_storage_install2()',
  'install-2 docker flow must validate redis/backend shared storage',
);
expectContains(
  install2Docker,
  'upsert_env "REDIS_HOST" "redis" "$ENV_PRODUCTION"',
  'install-2 docker env must define REDIS_HOST',
);
expectContains(
  install2Docker,
  'upsert_env "REDIS_PORT" "6379" "$ENV_PRODUCTION"',
  'install-2 docker env must define REDIS_PORT',
);

expectRegex(
  updateScript,
  /redis-cli -a "\$REDIS_PASSWORD" ping/,
  'update script must validate redis auth using redis-cli -a',
);
expectContains(
  updateScript,
  'Validando storage compartilhado do backend...',
  'update script must validate backend shared storage before concluding',
);

console.log('installer-redis-auth-regression: OK');
