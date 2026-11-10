import React from "react";

const Persist: React.FC = () => {
  const [error, setError] = React.useState(false);
  const [persisted, setPersisted] = React.useState(true); // Hide until we know otherwise

  React.useEffect(() => {
    if (navigator.storage) navigator.storage.persisted().then(setPersisted);
  }, []);

  if (persisted) return null;

  const handleClick = () => {
    navigator.storage
      .persist()
      .then((persisted) =>
        persisted ? setPersisted(persisted) : setError(true),
      );
  };

  return (
    <div className="Widget" style={{ textAlign: "center" }}>
      <h4>持久化设置</h4>
      <p>
        是否让 花与竹标签 请求浏览器永久保存您的设置？
      </p>
      {error ? (
        <p>暂时无法持久化设置。</p>
      ) : (
        <button className="button button--primary" onClick={handleClick}>
          持久化设置
        </button>
      )}
    </div>
  );
};

export default Persist;
