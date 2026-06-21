import { useState } from 'react';
import styles from './Gallery.module.css';

/** Horizontal scroll-snap image gallery with a live counter. */
export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  if (images.length === 0) return null;

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className={styles.gallery}>
      <div className={styles.track} onScroll={onScroll}>
        {images.map((src, i) => (
          <img
            // Images may repeat, so include the index in the key.
            key={`${i}-${src}`}
            className={styles.slide}
            src={src}
            alt={`${alt} (${i + 1})`}
            loading="lazy"
          />
        ))}
      </div>
      {images.length > 1 && (
        <span className={styles.counter}>
          {index + 1} / {images.length}
        </span>
      )}
    </div>
  );
}
