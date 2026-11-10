import React from "react";
import { MINUTES, HOURS } from "../../../utils";

import categories from "./categories";
import { Props, defaultData, JokeAPICategory } from "./types";

function updateSelectedCategories(
  existingCategories: Set<JokeAPICategory>,
  updatedCategory: JokeAPICategory,
  checked: boolean,
): Set<JokeAPICategory> {
  const isAnyCategoryChecked = updatedCategory === "any" && checked;
  const isLastItemBeingUnchecked = !checked && existingCategories.size === 1;

  if (isLastItemBeingUnchecked) {
    return existingCategories;
  }

  if (isAnyCategoryChecked) {
    return new Set(["any"]);
  }

  const categories = new Set(existingCategories);

  categories.delete("any");

  checked
    ? categories.add(updatedCategory)
    : categories.delete(updatedCategory);

  return categories;
}

const JokeSettings: React.FC<Props> = ({ data = defaultData, setData }) => {
  return (
    <div className="JokeSettings">
      <h5>每日笑话</h5>

      <label>
        显示新笑话
        <select
          value={data.timeout}
          onChange={(event) =>
            setData({ ...data, timeout: Number(event.target.value) })
          }
        >
          <option value={5 * MINUTES}>每 5 分钟</option>
          <option value={15 * MINUTES}>每 15 分钟</option>
          <option value={HOURS}>每小时</option>
          <option value={24 * HOURS}>每天</option>
          <option value={7 * 24 * HOURS}>每周</option>
        </select>
      </label>
      <label>
        Category
        {categories.map((category) => {
          return (
            <label key={category.key}>
              <input
                type="checkbox"
                checked={data.categories.has(category.key)}
                onChange={(event) => {
                  const categories = updateSelectedCategories(
                    data.categories,
                    category.key,
                    event.target.checked,
                  );

                  setData({ ...data, categories });
                }}
              />{" "}
              {category.name}
            </label>
          );
        })}
      </label>

      <p>
        Powered by{" "}
        <a
          href="https://jokeapi.dev/"
          target="_blank"
          rel="noopener noreferrer"
        >
          JokeAPI
        </a>
      </p>
    </div>
  );
};

export default JokeSettings;
