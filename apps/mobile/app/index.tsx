import { Redirect } from 'expo-router';

/** The app opens on the home tab, whatever the role. */
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
