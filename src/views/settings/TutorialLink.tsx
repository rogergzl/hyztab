import React from "react";

/**
 * Opens the bundled, offline tutorial page. Keeping it in its own file makes
 * the settings sidebar a list of independent sections, matching the project
 * convention that each feature owns its own module.
 */
const TutorialLink: React.FC = () => {
  const openTutorial = () => {
    const url = new URL("tutorial.html", document.baseURI).href;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="Widget TutorialLink">
      <h4>使用教程</h4>
      <p>快速链接、代理节点、标签分享与数据备份的完整操作说明。</p>
      <button className="button button--primary" onClick={openTutorial}>
        打开教程
      </button>
      <small>教程随扩展离线提供，不需要联网。</small>
    </div>
  );
};

export default React.memo(TutorialLink);
