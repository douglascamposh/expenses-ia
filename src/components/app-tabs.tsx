import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : (scheme as 'light' | 'dark')];
  // Tab bar white like mockup, selected = primary blue
  const lightColors = Colors.light;
  return (
    <NativeTabs
      backgroundColor={scheme === 'dark' ? colors.backgroundElement : '#FFFFFF'}
      indicatorColor={lightColors.primary}
      labelStyle={{ selected: { color: lightColors.primary } }}
      iconColor={{ selected: lightColors.primary, default: colors.textSecondary }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Expenses</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} md="article" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
