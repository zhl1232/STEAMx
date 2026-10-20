import React from 'react'

// Unit tests render Next Link itself. This isolated CSS/hit-testing fixture
// keeps its anchor contract without starting the Next application/router.
export default function Link({ href, prefetch, scroll, children, ...props }) {
  return <a href={href} data-prefetch={String(prefetch)} data-scroll={String(scroll)} {...props}>{children}</a>
}
