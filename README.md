# 集装箱托盘自动装箱 Demo

浏览器端本地最小 Demo：20GP / 40GP 集装箱，以托盘为最小单位自动装箱，左侧选货与限重信息，右侧 3D 展示装载动画。

## 运行

```bash
npm install
npm run dev
```

## 功能

- 箱型：20GP / 40GP
- 运输方式：海运 / 铁路（均采用 ISO 668 国际标准柜）
- 托盘目录选择与数量
- 自动装箱算法（地板排样 + 可选叠放）
- 3D 装载动画、跳过动画、低配模式

## 技术栈

Vite · React · TypeScript · Three.js / R3F · Zustand
