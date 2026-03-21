import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProcessedArticle } from '../types';

const ACCENT = '#38BDF8';

interface ArticleViewerProps {
  article: ProcessedArticle;
  onClose: () => void;
}

export default function ArticleViewer({ article, onClose }: ArticleViewerProps) {
  const wikiUrl = `https://en.m.wikipedia.org/wiki/${encodeURIComponent(article.title)}`;

  // Inject CSS to force dark mode and hide Wikipedia chrome
  const darkModeCSS = `
    body, .mw-body, .minerva-body-content, #content, .pre-content, .header-container,
    .page-heading, .mw-parser-output, .mf-section-0, .section-heading,
    main, article, .mw-page-container {
      background-color: #000 !important;
      color: #e0e0e0 !important;
    }
    /* Hide Wikipedia header/menu */
    .header-container, .minerva-header, header,
    .menu, .branding-box, .navigation-drawer,
    .search-box, #mw-mf-page-left,
    .last-modified-bar, .post-content,
    .mw-footer, footer, .talk-link,
    .page-actions-menu, #page-actions,
    .minerva__tab-container,
    .pre-content .page-heading-container,
    nav { display: none !important; }
    /* Dark mode for content */
    a { color: ${ACCENT} !important; }
    table, th, td { border-color: #333 !important; background-color: #111 !important; color: #e0e0e0 !important; }
    .infobox, .wikitable { background-color: #111 !important; }
    .mw-parser-output p, .mw-parser-output li, .mw-parser-output dd { color: #d1d5db !important; }
    h1, h2, h3, h4, h5, h6, .mw-heading { color: #fff !important; border-color: #333 !important; }
    .mw-body { padding-top: 8px !important; margin: 0 !important; }
    img { opacity: 0.9; }
    .thumb, .thumbinner { background-color: #111 !important; border-color: #333 !important; }
    .thumbcaption { color: #9ca3af !important; }
    code, pre { background-color: #1f2937 !important; color: #e0e0e0 !important; }
    .hatnote, .dablink { color: #9ca3af !important; background-color: #111 !important; }
    .ambox, .ombox, .tmbox { background-color: #111 !important; border-color: #333 !important; }
    .navbox, .vertical-navbox { background-color: #111 !important; border-color: #333 !important; }
    .reflist, .references { color: #9ca3af !important; }
    .catlinks { background-color: #111 !important; border-color: #333 !important; color: #9ca3af !important; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #000; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
  `;

  const injectedJS = `
    (function() {
      var style = document.createElement('style');
      style.textContent = ${JSON.stringify(darkModeCSS)};
      document.head.appendChild(style);
    })();
    true;
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="chevron-down" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="book" size={18} color={ACCENT} style={{ marginRight: 6 }} />
          <Text style={styles.headerBrand}>WikiTok</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS === 'web') {
              window.open(wikiUrl, '_blank');
            }
          }}
          style={styles.externalButton}
        >
          <Ionicons name="open-outline" size={22} color={ACCENT} />
        </TouchableOpacity>
      </View>
      <Text style={styles.articleTitle} numberOfLines={1}>{article.title}</Text>
      {Platform.OS === 'web' ? (
        <div style={{ flex: 1, display: 'flex', width: '100%', minHeight: 0 }}>
          <iframe
            src={wikiUrl}
            style={{
              width: '100%',
              flex: 1,
              border: 'none',
              backgroundColor: '#000',
            }}
            title={article.title}
            onLoad={(e: any) => {
              try {
                const doc = e.target.contentDocument;
                if (doc) {
                  const style = doc.createElement('style');
                  style.textContent = darkModeCSS;
                  doc.head.appendChild(style);
                }
              } catch (_) {
                // Cross-origin - can't inject CSS directly
              }
            }}
          />
        </div>
      ) : (
        <WebViewFallback url={wikiUrl} injectedJS={injectedJS} />
      )}
    </View>
  );
}

function WebViewFallback({ url, injectedJS }: { url: string; injectedJS: string }) {
  try {
    const { WebView } = require('react-native-webview');
    return (
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        injectedJavaScript={injectedJS}
        forceDarkOn={true}
      />
    );
  } catch {
    return (
      <View style={styles.fallback}>
        <Ionicons name="globe-outline" size={48} color="#6B7280" />
        <Text style={styles.fallbackText}>Open in browser to read the full article</Text>
        <Text style={styles.fallbackUrl}>{url}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 200,
    ...(Platform.OS === 'web' ? { display: 'flex', flexDirection: 'column' } : {}),
  } as any,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 54 : 12,
    paddingBottom: 8,
    backgroundColor: '#000',
  },
  closeButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  articleTitle: {
    color: '#9CA3AF',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 8,
    textAlign: 'center',
    backgroundColor: '#000',
  },
  externalButton: {
    padding: 4,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  fallback: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  fallbackText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  fallbackUrl: {
    color: ACCENT,
    fontSize: 13,
    marginTop: 8,
  },
});
