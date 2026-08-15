import { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Highlighter, X } from 'lucide-react';

type HighlightColor = 'none' | 'green' | 'yellow' | 'red' | 'amber';

const HIGHLIGHT_STYLES: Record<Exclude<HighlightColor, 'none'>, string> = {
  green: 'background-color: #bbf7d0;',
  yellow: 'background-color: #fef08a;',
  red: 'background-color: #fecaca;',
  amber: 'background-color: #fde68a;',
};

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = '300px' }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, []);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const applyHighlight = (color: Exclude<HighlightColor, 'none'>) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
      setShowHighlightMenu(false);
      return;
    }
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.setAttribute('style', HIGHLIGHT_STYLES[color]);
    try {
      range.surroundContents(span);
    } catch {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    setShowHighlightMenu(false);
  };

  const removeHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) { setShowHighlightMenu(false); return; }
    const range = selection.getRangeAt(0);
    const fragment = range.extractContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    tempDiv.querySelectorAll('span[style*="background-color"]').forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    });
    range.insertNode(tempDiv.firstChild);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
    setShowHighlightMenu(false);
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <button
          type="button"
          onClick={() => exec('bold')}
          className="p-1.5 rounded-lg hover:bg-gray-200 transition"
          title="Bold"
        >
          <Bold className="w-4 h-4 text-gray-700" />
        </button>
        <button
          type="button"
          onClick={() => exec('italic')}
          className="p-1.5 rounded-lg hover:bg-gray-200 transition"
          title="Italic"
        >
          <Italic className="w-4 h-4 text-gray-700" />
        </button>
        <button
          type="button"
          onClick={() => exec('underline')}
          className="p-1.5 rounded-lg hover:bg-gray-200 transition"
          title="Underline"
        >
          <Underline className="w-4 h-4 text-gray-700" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowHighlightMenu(!showHighlightMenu)}
            className="p-1.5 rounded-lg hover:bg-gray-200 transition flex items-center gap-1"
            title="Highlight"
          >
            <Highlighter className="w-4 h-4 text-gray-700" />
          </button>
          {showHighlightMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 flex gap-1 z-20">
              <button type="button" onClick={() => applyHighlight('green')} className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: '#bbf7d0' }} title="Green" />
              <button type="button" onClick={() => applyHighlight('yellow')} className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: '#fef08a' }} title="Yellow" />
              <button type="button" onClick={() => applyHighlight('amber')} className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: '#fde68a' }} title="Amber" />
              <button type="button" onClick={() => applyHighlight('red')} className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: '#fecaca' }} title="Red" />
              <button type="button" onClick={removeHighlight} className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center" title="Remove highlight">
                <X className="w-3 h-3 text-gray-500" />
              </button>
            </div>
          )}
        </div>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => editorRef.current && onChange(editorRef.current.innerHTML)}
        data-placeholder={placeholder}
        className="px-4 py-3 text-sm text-gray-800 outline-none overflow-y-auto rich-text-area"
        style={{ minHeight }}
      />
    </div>
  );
}
