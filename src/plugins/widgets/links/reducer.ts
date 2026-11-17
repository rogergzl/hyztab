import { Link, emptyLink } from "./types";
import { Action } from "./actions";

type State = Link[];

export function reducer(state: State, action: Action) {
  switch (action.type) {
    case "ADD_LINK":
      return state.concat(action.data.link ?? emptyLink());

    case "SET_LINKS":
      return [...action.data.links];

    case "ADD_LINKS": {
      const count = Math.max(0, Math.floor(action.data.count));
      return state.concat(Array.from({ length: count }, emptyLink));
    }

    case "INSERT_LINK": {
      const { index } = action.data;
      const links = [...state];

      // Slots are kept in order, so filling a cell past the end pads the gap
      // with empty links instead of quietly appending at the end.
      while (links.length < index) links.push(emptyLink());
      links.splice(index, 0, action.data.link ?? emptyLink());
      return links;
    }

    case "REMOVE_LINK":
      // The list is the grid, so clearing a link empties its cell rather than
      // closing the gap: everything after it would otherwise shift position.
      return state.map((link, index) =>
        index === action.data.index ? emptyLink() : link,
      );

    case "UPDATE_LINK":
      return state.map((link, index) =>
        index === action.data.index ? action.data.link : link,
      );

    case "REORDER_LINK": {
      const links = [...state];
      const from = Math.max(0, Math.floor(action.data.index));
      const to = Math.max(0, Math.floor(action.data.to));
      if (from === to) return state;

      // A slot only exists in the list up to the last link; the cells a page
      // shows beyond that hold nothing, so picking one up moves nothing.
      if (from >= links.length) return state;

      // A drop can land on a numbered cell past the last link, so pad the gap
      // first: the tile must appear in the cell it was dropped on.
      while (links.length <= to) links.push(emptyLink());

      // Swap the two cells instead of moving one and shifting the rest.
      // Removing and re-inserting pulls every later tile one place forward,
      // which renumbers the whole grid behind the drag and makes rearranging
      // harder rather than easier. Swapping leaves every other cell untouched,
      // and dropping onto an empty cell simply empties the one it came from.
      [links[from], links[to]] = [links[to], links[from]];
      return links;
    }

    default:
      throw new Error("Unknown action");
  }
}
