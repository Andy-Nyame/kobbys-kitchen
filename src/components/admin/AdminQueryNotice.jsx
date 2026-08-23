export default function AdminQueryNotice({ errors }) {
  const messages = Object.values(errors || {});

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="admin-notice admin-notice--warning" role="status">
      <strong>Some filters were ignored.</strong>
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
