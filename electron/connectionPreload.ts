import { contextBridge, ipcRenderer } from 'electron';

// This preload is used ONLY by the locally generated location picker.
contextBridge.exposeInMainWorld('budgetLocation', {
  save: (location: unknown): Promise<string | null> =>
    ipcRenderer.invoke('budget-location:save', location),
});
