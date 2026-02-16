"use client"

import { useSyncExternalStore } from "react"
import { store } from "@/lib/store"

const subscribe = (cb: () => void) => store.subscribe(cb)
const getSnapshot = () => store.getSnapshot()

export function useStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    datasets: snapshot.datasets,
    graders: snapshot.graders,
    experiments: snapshot.experiments,
    store,
  }
}
