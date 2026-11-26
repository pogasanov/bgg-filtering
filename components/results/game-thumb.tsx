type GameThumbProps = {
  url: string | null;
  size: 40 | 48;
};

/** Decorative: the title sits next to it, so the image carries no alt text. */
export function GameThumb({ url, size }: GameThumbProps) {
  if (!url) {
    return (
      <span
        data-thumb="placeholder"
        aria-hidden="true"
        className="block flex-none rounded-md bg-muted"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="flex-none rounded-md bg-muted object-cover"
      style={{ width: size, height: size }}
    />
  );
}
