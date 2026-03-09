import { ref, computed } from 'vue'
import type { Component } from 'vue'
import LoginView from './views/LoginView.vue'
import GetKeyView from './views/GetKeyView.vue'

// 定义路由类型
type RouteName = 'login' | 'get-key'

interface Route {
  name: RouteName
  component: Component
}

// 路由配置
const routes: Record<RouteName, Route> = {
  'login': { name: 'login', component: LoginView },
  'get-key': { name: 'get-key', component: GetKeyView }
}

// 当前路由状态
const currentRoute = ref<RouteName>('login')

// 当前组件
export const currentComponent = computed(() => {
  return routes[currentRoute.value]?.component || LoginView
})

// 导航函数
export function navigateTo(routeName: RouteName) {
  currentRoute.value = routeName
}

// 获取当前路由名称
export function getCurrentRoute(): RouteName {
  return currentRoute.value
}
