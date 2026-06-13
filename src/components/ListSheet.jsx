import { useEffect, useRef, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import {
  addListItem,
  setListItemChecked,
  updateListItemText,
  deleteListItem,
  reorderListItems,
} from '../lib/mementos';
import { getListTheme } from '../lib/listThemes';
import { ListGlyph } from './ListSticker';
import styles from './ListSheet.module.css';

const sortByPosition = (arr) => (arr ?? []).slice().sort((a, b) => a.position - b.position);
// Identity of the list's data — drives when local state re-syncs from props.
const listSignature = (arr) =>
  (arr ?? []).map((i) => `${i.id}:${i.position}:${i.checked ? 1 : 0}:${i.text}`).join('|');

// Fold the latest props into the current local order: keep the local ordering
// (so a just-finished drag isn't reverted by stale positions), adopt each
// item's latest data from props, keep optimistic temp rows, drop removed ones,
// and append anything new (e.g. the partner added it) by position.
function reconcileOrder(local, propsArr) {
  const byId = new Map((propsArr ?? []).map((p) => [p.id, p]));
  const result = [];
  for (const it of local) {
    if (byId.has(it.id)) { result.push(byId.get(it.id)); byId.delete(it.id); }
    else if (String(it.id).startsWith('temp-')) result.push(it);
  }
  if (byId.size) result.push(...sortByPosition([...byId.values()]));
  return result;
}

// View-mode row — checking off only, no fiddly/destructive controls. Plain
// element (no framer) so nothing can linger lifted after leaving edit mode.
function ViewRow({ item, onToggle }) {
  return (
    <div className={`${styles.row} ${item.checked ? styles.rowChecked : ''}`}>
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
      <span className={styles.rowText}>{item.text}</span>
    </div>
  );
}

// Edit-mode row — draggable (handle), renameable, deletable. Only mounted while
// editing. Drag is restricted to the handle via dragControls.
function EditRow({ item, onRemove, onDragStart, onDragEnd, editing, editingText, setEditingText, startEdit, commitEdit, cancelEdit }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="div"
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`${styles.row} ${item.checked ? styles.rowChecked : ''}`}
      whileDrag={{ scale: 1.02, boxShadow: '0 10px 24px rgba(26,18,8,0.22)' }}
    >
      <button
        type="button"
        className={styles.dragHandle}
        onPointerDown={(e) => controls.start(e)}
        aria-label="Drag to reorder"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M5 10h14M5 14h14" />
        </svg>
      </button>

      {editing ? (
        <input
          className={styles.editInput}
          value={editingText}
          autoFocus
          onChange={(e) => setEditingText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
          }}
        />
      ) : (
        <button type="button" className={styles.rowText} onClick={() => startEdit(item)}>
          {item.text}
        </button>
      )}

      <button
        type="button"
        className={styles.rowRemove}
        onClick={() => onRemove(item)}
        aria-label="Remove item"
      >×</button>
    </Reorder.Item>
  );
}

// The dedicated list view a themed sticker flips open into. Items are a shared
// surface — either partner can add, check off, and (in edit mode) reorder,
// rename, or remove them. The list is held in local state so framer-motion can
// reorder it smoothly; mutations persist to the DB and reconcile for the other
// partner via the memento_list_items realtime stream.
export default function ListSheet({
  memento,
  author,
  currentUserId,
  onClose,
  onItemsChanged,
  onDeleteRequested,
}) {
  const theme = getListTheme(memento?.list_theme);
  const [items, setItems] = useState(() => sortByPosition(memento?.list_items));
  const [draft, setDraft] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [error, setError] = useState(null);
  const draftRef = useRef(null);
  const tempIdRef = useRef(0);
  const draggingRef = useRef(false);

  // Re-sync local order from props when the underlying data changes (our own
  // saves, or the partner's realtime edits) — but never mid-drag, so framer's
  // in-flight reordering isn't clobbered.
  const signature = listSignature(memento?.list_items);
  useEffect(() => {
    if (draggingRef.current) return;
    setItems((prev) => reconcileOrder(prev, memento?.list_items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (editingId) return;        // let the row input handle its own Escape
      if (editMode) setEditMode(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editingId, editMode]);

  if (!memento) return null;

  const total = items.length;
  const checked = items.filter((i) => i.checked).length;
  const title = memento.title || theme.label;
  const authorName = author?.name || '';
  const authorColor = author?.accent_color || '#9C5E4A';
  const isAuthor = currentUserId && memento.author_id === currentUserId;

  // Update local + parent optimistically, run the server op, roll back on error.
  const apply = (next) => { setItems(next); onItemsChanged?.(next); };
  const commit = async (next, op) => {
    const prev = items;
    setError(null);
    apply(next);
    try {
      await op();
    } catch (err) {
      setError(err.message ?? String(err));
      apply(prev);
    }
  };

  const onAdd = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const tempId = `temp-${tempIdRef.current++}`;
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
    const optimistic = [...items, { id: tempId, text, checked: false, position }];
    const prev = items;
    setError(null);
    apply(optimistic);
    try {
      const created = await addListItem({ mementoId: memento.id, text, position });
      apply(optimistic.map((i) => (i.id === tempId ? { ...created } : i)));
    } catch (err) {
      setError(err.message ?? String(err));
      apply(prev);
    }
    draftRef.current?.focus();
  };

  const onToggle = (item) => {
    if (String(item.id).startsWith('temp-')) return;
    commit(items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)),
      () => setListItemChecked(item.id, !item.checked));
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };
  const cancelEdit = () => setEditingId(null);
  const commitEdit = () => {
    const item = items.find((i) => i.id === editingId);
    if (!item) { setEditingId(null); return; }
    const text = editingText.trim();
    setEditingId(null);
    if (!text || text === item.text) return;
    commit(items.map((i) => (i.id === item.id ? { ...i, text } : i)),
      () => updateListItemText(item.id, text));
  };

  const onRemove = (item) => {
    commit(items.filter((i) => i.id !== item.id), () => deleteListItem(item.id));
  };

  // Reorder: framer reorders our local array directly (stable identities, no
  // re-sort) for a smooth drag; we only renumber + persist on drop.
  const onReorder = (newOrder) => setItems(newOrder);
  const onDragStart = () => { draggingRef.current = true; };
  const onDragEnd = () => {
    draggingRef.current = false;
    // Keep the exact objects framer was dragging (stable identity = no jump);
    // persist positions by array index and let the board pin update.
    onItemsChanged?.(items);
    setError(null);
    reorderListItems(items).catch((err) => setError(err.message ?? String(err)));
  };

  const toggleEdit = () => {
    setEditingId(null);
    setEditMode((m) => !m);
  };

  return (
    <div
      className={styles.overlay}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
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
              : <ListGlyph shape={theme.shape} size={30} />}
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

        {total > 0 && (
          <div className={styles.tools}>
            <button type="button" className={styles.editToggle} onClick={toggleEdit}>
              {editMode ? 'Done' : 'Edit'}
            </button>
          </div>
        )}

        <div className={styles.items}>
          {items.length === 0 ? (
            <div className={styles.empty}>
              Add your first {theme.shape === 'ticket' ? 'movie' : 'item'} below.
            </div>
          ) : editMode ? (
            <Reorder.Group as="div" axis="y" values={items} onReorder={onReorder} className={styles.itemGroup}>
              {items.map((item) => (
                <EditRow
                  key={item.id}
                  item={item}
                  onRemove={onRemove}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  editing={editingId === item.id}
                  editingText={editingText}
                  setEditingText={setEditingText}
                  startEdit={startEdit}
                  commitEdit={commitEdit}
                  cancelEdit={cancelEdit}
                />
              ))}
            </Reorder.Group>
          ) : (
            <div className={styles.itemGroup}>
              {items.map((item) => (
                <ViewRow key={item.id} item={item} onToggle={onToggle} />
              ))}
            </div>
          )}
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
          {isAuthor && editMode && (
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
