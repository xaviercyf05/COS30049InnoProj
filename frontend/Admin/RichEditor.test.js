import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import RichEditor from './RichEditor';

const mockInjectJavaScript = jest.fn();

jest.mock('react-native-webview', () => {
  const ReactComponent = require('react').Component;
  const View = require('react-native').View;
  
  class MockWebView extends ReactComponent {
    injectJavaScript(script) {
      mockInjectJavaScript(script);
    }
    render() {
      return <View testID="mock-webview" {...this.props} />;
    }
  }
  return { WebView: MockWebView };
});

describe('RichEditor', () => {
  beforeEach(() => {
    mockInjectJavaScript.mockClear();
  });

  it('renders correctly', () => {
    const { getByTestId } = render(<RichEditor value="" onChange={() => {}} />);
    expect(getByTestId('mock-webview')).toBeTruthy();
  });

  it('calls onChange with clean HTML when message is received', () => {
    const handleChange = jest.fn();
    const { getByTestId } = render(<RichEditor value="" onChange={handleChange} />);
    const webView = getByTestId('mock-webview');

    fireEvent(webView, 'message', {
      nativeEvent: { data: '<p>Hello</p><script>alert(1)</script>' },
    });

    expect(handleChange).toHaveBeenCalledWith('<p>Hello</p>');
  });

  it('injects content when value prop changes', () => {
    const { rerender } = render(<RichEditor value="" onChange={() => {}} />);
    
    rerender(<RichEditor value="<h1>Title</h1>" onChange={() => {}} />);
    
    expect(mockInjectJavaScript).toHaveBeenCalled();
    expect(mockInjectJavaScript.mock.calls[0][0]).toContain('<h1>Title</h1>');
  });

  it('injects content on load end', () => {
    const { getByTestId } = render(<RichEditor value="<p>Load Content</p>" onChange={() => {}} />);
    const webView = getByTestId('mock-webview');
    
    mockInjectJavaScript.mockClear();
    fireEvent(webView, 'loadEnd');
    
    expect(mockInjectJavaScript).toHaveBeenCalled();
    expect(mockInjectJavaScript.mock.calls[0][0]).toContain('<p>Load Content</p>');
  });
});