module.exports = {
  apps: [{
    name: 'stressbot-backend',
    script: 'server.js',
    env: { NODE_ENV: 'development' },
    watch: false,
    instances: 1,
    exec_mode: 'fork'
  }]
}
