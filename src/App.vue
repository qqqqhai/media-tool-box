<template>
  <div id="app">
    <h1>离线多媒体处理工具箱</h1>
    <TestFfmpeg />
    <!-- 新增Worker验证demo -->
    <TestWorker />
  </div>
</template>

<script setup>
import TestFfmpeg from './components/TestFfmpeg.vue'
import TestWorker from './components/TestWorker.vue'
</script>

<style scoped>
#app {
  width: 100vw;
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 20px;
}
</style>