const cp = require('node:child_process');
const origSpawn = cp.spawn;
const origFork = cp.fork;
function safe(v){try{return JSON.stringify(v)}catch{return String(v)}}
cp.spawn = function(file,args,opts){
  console.error('[spawn-call]', file, safe(args));
  try {
    const child = origSpawn.call(this,file,args,opts);
    child.on('error', (err)=>{
      console.error('[spawn-error]', file, err && err.code, err && err.syscall, err && err.path);
    });
    return child;
  } catch (err) {
    console.error('[spawn-throw]', file, err && err.code, err && err.syscall, err && err.path);
    throw err;
  }
};
cp.fork = function(modulePath,args,opts){
  console.error('[fork-call]', modulePath, safe(args));
  try {
    const child = origFork.call(this,modulePath,args,opts);
    child.on('error', (err)=>{
      console.error('[fork-error]', modulePath, err && err.code, err && err.syscall, err && err.path);
    });
    return child;
  } catch (err) {
    console.error('[fork-throw]', modulePath, err && err.code, err && err.syscall, err && err.path);
    throw err;
  }
};
