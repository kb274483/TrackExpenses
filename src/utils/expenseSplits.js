export const SPLIT_METHOD_OPTIONS = [
  { label: '均分', value: 'equal' },
  { label: '份數', value: 'shares' },
  { label: '固定金額', value: 'exact' },
  { label: '百分比', value: 'percentage' },
];

export const buildSplitValuesMap = (source = {}) => {
  const nextMap = {};

  if (Array.isArray(source.splits)) {
    source.splits.forEach((split) => {
      if (split?.memberId) {
        nextMap[split.memberId] = Number(split.value) || 0;
      }
    });
  }

  return nextMap;
};

export const normalizeParticipantIds = (participants = []) => (
  Array.isArray(participants) ? participants.filter(Boolean) : []
);

export const getInitialSplitValues = (method, participants = [], totalAmount = 0) => {
  const memberIds = normalizeParticipantIds(participants);
  const total = Number(totalAmount) || 0;
  const nextMap = {};

  if (method === 'shares') {
    memberIds.forEach((id) => {
      nextMap[id] = 1;
    });
  } else if (method === 'exact' && memberIds.length > 0) {
    const perPerson = Math.floor(total / memberIds.length);
    memberIds.forEach((id, index) => {
      nextMap[id] = index === memberIds.length - 1
        ? total - perPerson * (memberIds.length - 1)
        : perPerson;
    });
  } else if (method === 'percentage' && memberIds.length > 0) {
    const perPerson = Math.floor((100 / memberIds.length) * 10) / 10;
    memberIds.forEach((id, index) => {
      nextMap[id] = index === memberIds.length - 1
        ? Number((100 - perPerson * (memberIds.length - 1)).toFixed(1))
        : perPerson;
    });
  }

  return nextMap;
};

export const syncSplitValuesForParticipants = (
  method,
  participants = [],
  splitValues = {},
) => {
  if (!method || method === 'equal') return {};

  const memberIds = normalizeParticipantIds(participants);
  const nextMap = {};

  memberIds.forEach((id) => {
    if (Object.prototype.hasOwnProperty.call(splitValues, id)) {
      nextMap[id] = splitValues[id];
    } else {
      nextMap[id] = method === 'shares' ? 1 : 0;
    }
  });

  return nextMap;
};

export const computeSplitAmounts = ({
  totalAmount,
  splitMethod = 'equal',
  participants = [],
  splitValues = {},
}) => {
  const total = Number(totalAmount) || 0;
  const method = splitMethod || 'equal';
  const memberIds = normalizeParticipantIds(participants);
  const result = {};

  if (memberIds.length === 0) return result;

  if (method === 'equal') {
    const perPerson = total / memberIds.length;
    memberIds.forEach((id) => {
      result[id] = perPerson;
    });
    return result;
  }

  if (method === 'shares') {
    const totalShares = memberIds.reduce((sum, id) => (
      sum + (Number(splitValues[id]) || 0)
    ), 0);
    memberIds.forEach((id) => {
      result[id] = totalShares === 0
        ? 0
        : (total * (Number(splitValues[id]) || 0)) / totalShares;
    });
    return result;
  }

  if (method === 'exact') {
    memberIds.forEach((id) => {
      result[id] = Number(splitValues[id]) || 0;
    });
    return result;
  }

  if (method === 'percentage') {
    memberIds.forEach((id) => {
      result[id] = (total * (Number(splitValues[id]) || 0)) / 100;
    });
  }

  return result;
};

export const getSplitStatusText = ({
  totalAmount,
  splitMethod,
  participants = [],
  splitValues = {},
}) => {
  const method = splitMethod || 'equal';
  const total = Number(totalAmount) || 0;
  const memberIds = normalizeParticipantIds(participants);
  const sum = memberIds.reduce((acc, id) => acc + (Number(splitValues[id]) || 0), 0);

  if (method === 'exact') {
    const diff = total - sum;
    const status = `已分配 $${sum.toLocaleString('zh-TW')} / 總額 $${total.toLocaleString('zh-TW')}`;
    if (diff === 0) return `${status} ✓`;
    return `${status}（${diff > 0 ? '尚差' : '超過'} $${Math.abs(diff).toLocaleString('zh-TW')}）`;
  }

  if (method === 'percentage') {
    const diff = 100 - sum;
    if (Math.abs(diff) < 0.01) return `已分配 ${sum.toFixed(1)}% ✓`;
    return `已分配 ${sum.toFixed(1)}%（${diff > 0 ? '尚差' : '超過'} ${Math.abs(diff).toFixed(1)}%）`;
  }

  if (method === 'shares') {
    return `總份數：${sum} 份`;
  }

  return '';
};

export const isSplitValid = ({
  totalAmount,
  splitMethod = 'equal',
  participants = [],
  splitValues = {},
}) => {
  const method = splitMethod || 'equal';
  const total = Number(totalAmount) || 0;
  const memberIds = normalizeParticipantIds(participants);
  const sum = memberIds.reduce((acc, id) => acc + (Number(splitValues[id]) || 0), 0);

  if (method === 'equal') return true;
  if (method === 'shares') return sum > 0;
  if (method === 'exact') return sum === total;
  if (method === 'percentage') return Math.abs(100 - sum) < 0.01;
  return true;
};

export const normalizeSplits = (splitMethod, participants = [], splitValues = {}) => {
  if (!splitMethod || splitMethod === 'equal') return null;

  return normalizeParticipantIds(participants).map((memberId) => ({
    memberId,
    value: Number(splitValues[memberId]) || 0,
  }));
};
