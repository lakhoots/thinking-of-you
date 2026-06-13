import { useEffect, useRef, useState } from 'react';
import {
  addListItem,
  setListItemChecked,
  updateListItemText,
  deleteListItem,
} from '../lib/mementos';
import { getListTheme } from '../lib/listThemes';
import styles from './ListSheet.module.css';

// The dedicated list view a themed sticker flips open into. Items are a shared
// surface — either partner can add, check off, edit, or remove them — so all
// mutations are optimistic locally (via onItemsChanged) and reconciled for the
// other partner through the memento_list_items realtime stream.
export default function ListSheet({
  memento,
  author,
  currentUserId,
  onClose,
  onItemsChanged,
  onDeleteRequested,
}) {
  const theme = getListTheme(memento?.list_theme);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [error, setError] = useState(null);
  const draftRef = useRef(null);
  const tempIdRef = useRef(0);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !editingId) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editingId]);

  if (!memento) return null;

  const items = (memento.list_items ?? []).slice().sort((a, b) => a.position - b.position);
  const total = items.length;
  const checked = items.filter((i) => i.checked).length;
  const title = memento.title || theme.label;
  const authorName = author?.name || '';
  const authorColor = author?.accent_color || '#9C5E4A';
  const isAuthor = currentUserId && memento.author_id === currentUserId;

  // Apply a new items array locally, then run the server op; on failure roll
  // back to the snapshot and surface the error.
  const commit = async (nextItems, op) => {
    const prev = items;
    setError(null);
    onItemsChanged?.(nextItems);
    try {
      await op();
    } catch (err) {
      setError(err.message ?? String(err));
      onItemsChanged?.(prev);
    }
  };

  const onAdd = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const tempId = `temp-${tempIdRef.current++}`;
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
    const optimistic = [...items, { id: tempId, text, checked: false, position }];
    await commit(optimistic, async () => {
      const created = await addListItem({ mementoId: memento.id, text, position });
      // Swap the temp row for the real one (keeps order, real id for toggles).
      onItemsChanged?.(
        [...items, { ...created }].sort((a, b) => a.position - b.position),
      );
    });
    draftRef.current?.focus();
  };

  const onToggle = (item) => {
    if (String(item.id).startsWith('temp-')) return; // not persisted yet
    const next = items.map((i) =>
      i.id === item.id ? { ...i, checked: !i.checked } : i,
    );
    commit(next, () => setListItemChecked(item.id, !item.checked));
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const commitEdit = () => {
    const item = items.find((i) => i.id === editingId);
    if (!item) { setEditingId(null); return; }
    const text = editingText.trim();
    setEditingId(null);
    if (!text || text === item.text) return;
    const next = items.map((i) => (i.id === item.id ? { ...i, text } : i));
    commit(next, () => updateListItemText(item.id, text));
  };

  const onRemove = (item) => {
    const next = items.filter((i) => i.id !== item.id);
    commit(next, () => deleteListItem(item.id));
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <button
        className={styles.close}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 6l12 12M18 6l-12 12" />
        </svg>
      </button>

      <div
        className={styles.sheet}
        style={{ '--accent': theme.accent }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerEmoji}>
            {memento.image_url
              ? <img src={memento.image_url} alt="" />
              : theme.emoji}
          </div>
          <div className={styles.headerText}>
            <div className={styles.headerTitle}>{title}</div>
            <div className={styles.headerMeta}>
              {total === 0
                ? 'Nothing here yet'
                : `${checked} of ${total} ${theme.checkedVerb}`}
            </div>
          </div>
        </div>

        <div className={styles.items}>
          {items.length === 0 && (
            <div className={styles.empty}>
              Add your first {theme.checkedVerb === 'watched' ? 'movie' : 'item'} below.
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className={`${styles.row} ${item.checked ? styles.rowChecked : ''}`}>
              <button
                type="button"
                className={styles.check}
                onClick={() => onToggle(item)}
                aria-label={item.checked ? 'Mark not done' : 'Mark done'}
              >
                {item.checked && (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {editingId === item.id ? (
                <input
                  className={styles.editInput}
                  value={editingText}
                  autoFocus
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                    if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={styles.rowText}
                  onClick={() => startEdit(item)}
                >
                  {item.text}
                </button>
              )}

              <button
                type="button"
                className={styles.rowRemove}
                onClick={() => onRemove(item)}
                aria-label="Remove item"
              >×</button>
            </div>
          ))}
        </div>

        <div className={styles.addRow}>
          <input
            ref={draftRef}
            className={styles.addInput}
            placeholder={theme.itemPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onAdd(); }
            }}
          />
          <button
            type="button"
            className={styles.addBtn}
            onClick={onAdd}
            disabled={!draft.trim()}
          >Add</button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.footer}>
          <div className={styles.authorBlock}>
            <div className={styles.authorPip} style={{ background: authorColor }} />
            <div className={styles.authorName}>started by {authorName}</div>
          </div>
          {isAuthor && (
            <button
              className={styles.deleteBtn}
              onClick={() => onDeleteRequested?.(memento.id)}
            >
              Remove list
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
