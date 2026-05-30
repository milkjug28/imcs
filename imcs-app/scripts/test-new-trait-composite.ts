import { writeFileSync } from 'fs'
import { compositeSavant } from '@/lib/trait-renderer'

// token1 base slots, swap slot7 (hatss) -> new "doge" 7040, slot5 (moufs) -> new "umph" 5017
const slots = [12, 1002, 2029, 0, 4006, 5017, 0, 7040, 0, 9002]

;(async () => {
  const buf = await compositeSavant(slots, 1)
  writeFileSync('/tmp/token1-newtrait.png', buf)
  console.log('wrote /tmp/token1-newtrait.png', buf.length, 'bytes')
})()
