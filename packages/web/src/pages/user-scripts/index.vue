
<template>
  <div class="col-10 m-auto ">
    <a-tabs v-model:activeKey="activeKey">
      <a-tab-pane
        key="1"
        tab="本地脚本"
      >
        <div v-if="store.userScripts.length === 0">
          <a-empty description="暂无数据, 搜索喜欢的脚本进行添加哦~" />
        </div>
        <div
          v-else
          class="p-2"
        >
          <p class="text-secondary">
            文件中选择 <code>自动加载脚本</code> ，启动后会自动 <code>安装/更新</code> 以下脚本到浏览器。
          </p>
          <ScriptList

            :scripts="store.userScripts"
          >
            <template #actions="{script}">
              <a-button
                size="small"
                danger
                type="primary"
                @click="onRemoveScript(script)"
              >
                <Icon type="icon-delete" /> 移除
              </a-button>
            </template>
          </ScriptList>
        </div>
      </a-tab-pane>
      <a-tab-pane
        key="2"
        tab="脚本搜索"
      >
        <div class=" user-script-page ">
          <div class="col-12 actions d-flex">
            <a-input-search
              v-model:value="searchValue"
              placeholder="输入脚本名进行搜索"
              enter-button
              @search="onSearch"
            />
          </div>

          <div
            class="col-12"
          >
            <a-tabs v-model:activeKey="engineKey">
              <a-tab-pane
                v-for="item of engineSearchList"
                :key="item.engine.name"
                :tab="item.engine.name"
              >
                <div v-if="item.loading">
                  <a-skeleton />
                </div>
                <div v-else-if="item.error">
                  <a-empty description="请求出错，请重新尝试" />
                </div>
                <div v-else-if="item.list.length === 0">
                  <a-empty description="暂无数据" />
                </div>
                <div
                  v-else
                  class="user-script-list "
                >
                  <div class="pb-1">
                    数据来源 :  <a
                      :href="item.engine.homepage"
                      target="_blank"
                    >{{ item.engine.homepage }}</a>
                  </div>

                  <ScriptList :scripts="item.list">
                    <template #actions="{script}">
                      <a-button
                        size="small"
                        type="primary"
                        @click="onAddScript(script)"
                      >
                        <Icon type="icon-plus" /> 添加
                      </a-button>
                    </template>
                  </ScriptList>
                </div>
              </a-tab-pane>
            </a-tabs>
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang='ts'>

import { ref } from 'vue';

import { config } from '../../config';
import { ScriptSearchEngine } from '../../types/user.script';
import { store, StoreUserScript } from '../../store';
import ScriptList from './ScriptList.vue';

/** 搜索列表 */
const engineSearchList = ref<{
  engine: ScriptSearchEngine,
  loading?: boolean,
  error?: boolean,
  list: StoreUserScript[]
}[]>(config.scriptSearchEngines
  .map(engine => ({ engine, list: [] })));

/** 标签页 */
const activeKey = ref('1');
/** 搜索引擎标签 */
const engineKey = ref(config.scriptSearchEngines[0].name);
/** 搜索值 */
const searchValue = ref('');

function onSearch(value: string) {
  // 清空列表

  engineSearchList.value.forEach(async(item) => {
    item.loading = true;
    item.error = false;
    try {
      const commonScripts = await item.engine.search(value, 1, 10);
      console.log('commonScripts', commonScripts);

      item.list = commonScripts.map(s => ({
        id: s.id,
        url: s.code_url,
        runAtAll: true,
        runAtFiles: [],
        info: s
      }));
    } catch (err) {
      console.log(err);
      item.error = true;
    }
    item.loading = false;
  });
}

function onAddScript(script: StoreUserScript) {
  store.userScripts.push(script);
}

function onRemoveScript(script: StoreUserScript) {
  store.userScripts.splice(store.userScripts.indexOf(script), 1);
}

</script>

<style scope lang='less'>
.anticon {
  transform: translate(0.5px, -3px);
  height: calc();
}

.actions{

  div + div{
      margin-left: 4px;
  }

}

.ant-tabs-bar{
  margin: 0 0 8px 0 !important;
}

</style>
