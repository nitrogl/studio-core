-- Some Pandoc filters
--
-- SPDX-License-Identifier: MIT

local folder = "docs"

-- Reads what the build gives
local function meta(m)
  if m.folder then folder = pandoc.utils.stringify(m.folder) end
  return m
end

-- The path of a relative address from the top of the repository, or nil when it goes above it
local function resolve(base, relative)
  local parts = {}
  for part in (base .. "/" .. relative):gmatch("[^/]+") do
    if part == ".." then
      if #parts == 0 then return nil end
      table.remove(parts)
    elseif part ~= "." then
      table.insert(parts, part)
    end
  end
  return table.concat(parts, "/")
end

local function retarget(target)
  -- An address with a scheme, or an anchor of the page, stays as it is
  if target:match("^%a[%w+.-]*:") or target:match("^#") then return target end
  local address = target:match("^([^#]*)")
  local path = resolve(folder, address)

  -- A file outside docs/ is served as it is
  if address ~= "" and (not path or (path ~= "docs" and path:sub(1, 5) ~= "docs/")) then return target end
  target = target:gsub("%.md$", ".html"):gsub("%.md#", ".html#")
  target = target:gsub("/$", "/index.html"):gsub("/#", "/index.html#")
  if target == "" or target == "." or target == "./" then target = "index.html" end
  return target
end

local function link(element)
  element.target = retarget(element.target)
  return element
end

-- Formula
local function math(element)
  if element.mathtype == "DisplayMath" then
    return pandoc.Span({ element }, { class = "display-math" })
  end
  return element
end

-- Use the first heading of level 1 as the title of the page
local function document(doc)
  for i, block in ipairs(doc.blocks) do
    if block.t == "Header" and block.level == 1 then
      doc.meta.title = pandoc.MetaInlines(block.content)
      doc.meta["title-id"] = block.identifier
      table.remove(doc.blocks, i)
      break
    end
  end
  return doc
end

return { { Meta = meta }, { Link = link, Math = math }, { Pandoc = document } }
