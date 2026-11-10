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

    case "REORDER_LINK":
      const links = [...state];
      links.splice(action.data.to, 0, links.splice(action.data.index, 1)[0]);
      return links;

    default:
      throw new Error("Unknown action");
  }
}
