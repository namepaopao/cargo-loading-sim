import { LeftPanel } from './components/LeftPanel/LeftPanel'
import { Viewport3D } from './components/Viewport3D/Viewport3D'
import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.app}>
      <div className={styles.left}>
        <LeftPanel />
      </div>
      <div className={styles.right}>
        <Viewport3D />
      </div>
    </div>
  )
}
