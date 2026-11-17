// The page heading: title and one line on the left, the page's actions on the right
export default function PageHead({ title, subtitle, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </header>
  )
}
