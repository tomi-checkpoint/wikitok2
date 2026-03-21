import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { AppProvider, useApp } from '../src/store/AppContext';
import ArticleViewer from '../src/components/ArticleViewer';

function RootContent() {
  const { articleViewer, closeViewer } = useApp();

  // TODO: When Supabase is connected, check auth state here
  // If no session → show (auth) screens
  // If session but no profile → show username selection
  // If session + profile → show (tabs)

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="edit-profile"
          options={{
            presentation: 'card',
          }}
        />
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
