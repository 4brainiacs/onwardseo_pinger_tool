import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function EmbedCode() {
  const [copied, setCopied] = useState(false);

  const embedCode = `<!-- OnwardSEO URL Pinger Tool - Dynamic Height Embed -->
<iframe
  id="onwardseo-pinger"
  src="${window.location.origin}"
  title="URL Pinger Tool"
  style="width: 100%; min-height: 500px; border: none; overflow: hidden; display: block; background-color: #FFFFFF;"
  scrolling="no"
  frameborder="0"
  loading="lazy"
  allow="clipboard-write"
></iframe>
<script>
(function() {
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'pinger-resize' && e.data.source === 'onwardseo-pinger') {
      var iframe = document.getElementById('onwardseo-pinger');
      if (iframe && e.data.height) {
        iframe.style.height = e.data.height + 'px';
      }
    }
  });
})();
</script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 max-w-md bg-white rounded-lg shadow-lg p-4 border border-gray-200">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-base font-semibold text-gray-900">Embed this tool</h4>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-base text-blue-600 hover:text-blue-800 min-h-[44px] px-3 py-2 touch-manipulation"
        >
          {copied ? (
            <Check className="h-5 w-5" />
          ) : (
            <Copy className="h-5 w-5" />
          )}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap break-all">
        {embedCode}
      </pre>
    </div>
  );
}
