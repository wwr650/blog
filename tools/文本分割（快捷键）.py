# coding: utf-8
from pathlib import Path
import re


def format_text(text):
  """
  将输入的文本按照特定格式进行格式化
  支持四种格式：
  1. 字母和汉字分行：字母|汉字（多个汉字用、分隔）
  2. 字母,英文(中文)格式：字母|英文(中文)
  3. 特殊字符格式：字母+特殊字符,描述
  4. 方括号格式：【CTRL】+L*描述
  """
  text = text.strip()
  if not text:
    return ""

  # 按行分析，逐行判断格式
  lines = text.split('\n')

  # 统计各种格式的行数
  type1_count = 0  # 纯字母行
  type2_count = 0  # 字母,英文(中文)
  type3_count = 0  # 包含逗号但不含括号
  type4_count = 0  # 包含【】的格式

  for line in lines:
    line = line.strip()
    if not line:
      continue

    if line.isalpha() and not any('\u4e00' <= char <= '\u9fff' for char in line):
      type1_count += 1
    elif re.search(r'[A-Z]+,\s*\*?[A-Z]+\([^)]+\)', line):
      type2_count += 1
    elif '【' in line and '】' in line:
      type4_count += 1
    elif ',' in line:
      type3_count += 1

  # 根据主要格式决定处理方式
  if type4_count > 0:
    return format_type4(text)
  elif type2_count > 0 and type2_count >= type3_count:
    return format_type2(text)
  elif type3_count > 0:
    return format_type3(text)
  else:
    return format_type1(text)


def format_type1(text):
  """
  处理第一种格式：字母和汉字分行
  """
  lines = text.strip().split('\n')
  result = []
  current_letter = None
  current_chinese = []

  for line in lines:
    line = line.strip()
    if not line:
      continue

    # 判断是否是字母行（只包含字母，不包含汉字）
    if line.isalpha() and all('\u4e00' <= char <= '\u9fff' for char in line) == False:
      # 如果之前有收集的字母和汉字，先处理它们
      if current_letter is not None and current_chinese:
        if len(current_chinese) == 1:
          result.append(f"{current_letter}|{current_chinese[0]}")
        else:
          result.append(f"{current_letter}|{'、'.join(current_chinese)}")

      # 开始新的字母
      current_letter = line
      current_chinese = []
    else:
      # 这是汉字行，添加到当前字母的汉字列表中
      current_chinese.append(line)

  # 处理最后一组数据
  if current_letter is not None and current_chinese:
    if len(current_chinese) == 1:
      result.append(f"{current_letter}|{current_chinese[0]}")
    else:
      result.append(f"{current_letter}|{'、'.join(current_chinese)}")

  return '\n'.join(result)


def format_type2(text):
  """
  处理第二种格式：字母,英文(中文)
  """
  # 清理文本中的多余空格
  text = re.sub(r'\s+', ' ', text.strip())

  # 匹配模式：字母,英文(中文)
  pattern = r'([A-Z]+)\s*,\s*(\*?[A-Z]+)\(([^)]+)\)'
  matches = re.findall(pattern, text)

  result = []
  for match in matches:
    letter = match[0]  # 字母部分
    english = match[1]  # 英文部分
    chinese = match[2]  # 中文部分
    result.append(f"{letter}|{english}({chinese})")

  return '\n'.join(result)


def format_type3(text):
  """
  处理第三种格式：特殊字符格式，如"Z+空格+空格，*实时缩放"
  """
  lines = text.strip().split('\n')
  result = []

  for line in lines:
    line = line.strip()
    if not line:
      continue

    # 处理各种可能的分隔符：中文逗号、英文逗号
    line = line.replace('，', ',')  # 中文逗号转英文逗号

    # 使用正则表达式匹配：字母部分，后跟逗号和描述
    match = re.match(r'^([^,]+),\s*(.*)$', line)
    if match:
      letter_part = match.group(1).strip()
      description = match.group(2).strip()
      result.append(f"{letter_part}|{description}")
    else:
      # 如果没有匹配到，尝试直接按逗号分割
      parts = line.split(',', 1)
      if len(parts) == 2:
        letter_part = parts[0].strip()
        description = parts[1].strip()
        result.append(f"{letter_part}|{description}")
      else:
        # 如果连逗号都没有，保持原样
        result.append(line)

  return '\n'.join(result)


def format_type4(text):
  """
  处理第四种格式：方括号格式，如"【CTRL】+L*ORTHO(正交)"
  """
  lines = text.strip().split('\n')
  result = []

  for line in lines:
    line = line.strip()
    if not line:
      continue

    # 如果一行中有多个项目（用空格分隔），先分割
    # 使用更精确的分割方式，确保不会在【】内部分割
    items = []
    current_item = ""
    in_brackets = False

    for char in line:
      if char == '【':
        in_brackets = True
      elif char == '】':
        in_brackets = False

      if char == ' ' and not in_brackets and current_item:
        items.append(current_item)
        current_item = ""
      else:
        current_item += char

    if current_item:
      items.append(current_item)

    for item in items:
      if not item:
        continue

      # 清理空格并匹配模式
      item = item.strip()

      # 使用更灵活的正则表达式，允许*前后有空格
      # 匹配模式：【内容】+数字或字母 * 描述
      match = re.match(r'^(【[^】]+】\+[^*]+)\s*\*\s*(.*)$', item)
      if match:
        key_part = match.group(1).strip()  # 【CTRL】+1 部分
        description = match.group(2).strip()  # PROPERTIES(修改特性) 部分
        result.append(f"{key_part}|*{description}")
      else:
        # 如果没有匹配到，尝试简单的*分割
        if '*' in item:
          parts = item.split('*', 1)
          key_part = parts[0].strip()
          description = parts[1].strip()
          result.append(f"{key_part}|*{description}")
        else:
          # 如果没有分隔符，保持原样
          result.append(item)

  return '\n'.join(result)


def add_pipes_to_text(text):
  """
  为文本中每行的前后加上竖线 |，跳过已经包含竖线的行

  Args:
      text (str): 输入的文本

  Returns:
      str: 处理后的文本
  """
  lines = text.split('\n')
  processed_lines = []

  for line in lines:
    # 去除首尾空白字符
    stripped_line = line.strip()

    # 如果行不为空
    if stripped_line:
      # 检查是否已经以 | 开头和结尾
      if stripped_line.startswith('|') and stripped_line.endswith('|'):
        # 已经包含竖线，直接使用
        processed_lines.append(stripped_line)
      else:
        # 没有竖线，加上竖线
        processed_lines.append('|' + stripped_line + '|')

  return '\n'.join(processed_lines)

if __name__ == '__main__':
  file = input("分割：请输入文本绝对路径")
  if file == "0":
    pass
  else:
    file_path = Path(file.strip())  # 自动处理路径分隔符和清理

    with open(file_path, 'r', encoding='utf-8') as f:
      text = f.read()
    formatted_text = format_text(text)
    print(formatted_text)
    try:
      with open('output_format.txt', 'w', encoding='utf-8') as file:
        file.write(formatted_text)
      print("\n结果已成功保存到 output_format.txt")
    except Exception as e:
      print(f"\n保存文件时出错: {e}")

  file_1 = input("加竖杠：请输入文本绝对路径")
  if file_1 == "0":
    pass
  else:
    file_path_1 = Path(file_1.strip())  # 自动处理路径分隔符和清理

    with open(file_path_1, 'r', encoding='utf-8') as f:
      text_1 = f.read()
    final_result = add_pipes_to_text(text_1)
    try:
      with open('output_add_pipes.txt', 'w', encoding='utf-8') as file:
        file.write(final_result)
      print("\n结果已成功保存到 output_add_pipes.txt")
    except Exception as e:
      print(f"\n保存文件时出错: {e}")
