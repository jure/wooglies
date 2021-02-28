import create from 'zustand'
// import { uid } from 'react-uid'
import { SnapshotInterpolation } from '@geckos.io/snapshot-interpolation'

export const SI = new SnapshotInterpolation(15)

export const useClientStore = create((set) => ({
  clients: [],
  setClients: (clients) =>
    set((state) => ({
      clients,
    })),
  addClient: (id, clientData) =>
    set((state) => {
      const newClients = [...state.clients]
      const index = newClients.findIndex((c) => c.id === id)
      if (index > -1) {
        newClients[index] = clientData
      } else {
        newClients.push(clientData)
      }
      return { clients: newClients }
    }),
  deleteClient: (clientId) =>
    set((state) => {
      const newClients = state.clients.filter((c) => c.id !== clientId)
      return { clients: newClients }
    }),
  updateClient: (clientId, update) =>
    set((state) => ({
      clients: state.clients.map((client) => {
        if (client.id === clientId) {
          return {
            ...client,
            ...update,
          }
        }

        return client
      }),
    })),
}))
