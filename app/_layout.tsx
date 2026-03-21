import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { AppProvider, useApp } from '../src/store/AppContext';
import ArticleViewer from '../src/components/ArticleViewer';

function RootContent() {
  const { articleViewer, closeViewer } = useApp();
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      {articleViewer ? (
        <ArticleViewer article={articleViewer} onClose={closeViewer} />
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <RootContent />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
