import React from "react";
import Modal from "./modal/Modal";

type Props = {
  onClose: () => void;
};

const StoreError: React.FC<Props> = ({ onClose }) => {
  return (
    <Modal onClose={onClose}>
      <div className="Settings">
        <h2 style={{ margin: 0 }}>存储错误</h2>
        <p style={{ fontSize: "1.25em" }}>
          花与竹标签 无法加载或保存设置。这通常是由于
          在隐私浏览模式下运行导致的；但磁盘空间不足或
          浏览器配置文件损坏也可能导致此问题。
        </p>
        <p>
          如果您已在 花与竹标签 中保存了设置，这可能是临时
          问题。请尝试重启浏览器并检查设置是否恢复。
        </p>
        <p>
          如果设置未恢复，{" "}
          <a href="https://aphqsia.com/" target="_blank" rel="noopener noreferrer">
            访问支持页面
          </a>
          ，其中介绍了常见原因及解决方法。
        </p>
        <div className="Modal-footer">
          <a
            className="button button--primary"
            href="https://aphqsia.com/"
            style={{ fontSize: "1.1em" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            访问支持页面
          </a>
        </div>
      </div>
    </Modal>
  );
};

export default StoreError;
