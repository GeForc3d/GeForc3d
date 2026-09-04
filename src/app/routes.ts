/** Every route in one place so links never drift from the router. */
export const routes = {
  home: '/',
  poses: '/poses',
  pose: (id: string) => `/pose/${id}`,
  posePattern: '/pose/:poseId',
  camera: '/camera',
  saved: '/saved',
  assets: '/dev/assets',
} as const;
