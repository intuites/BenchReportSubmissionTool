// A plain panel; the name stays so callers did not have to change
export default function Glass({ as: Tag = 'div', className = '', children, ...rest }) {
  return <Tag className={`panel ${className}`} {...rest}>{children}</Tag>
}
