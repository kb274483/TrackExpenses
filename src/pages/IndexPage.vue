<template>
  <q-page class="tw-flex tw-justify-center tw-items-center">
    <q-card class="tw-w-full xs:tw-w-2/3 tw-mx-4 bg-secondary tw-text-white">
      <q-card-section>
        <div class="text-h6 tw-text-center">
          Choose to join or create.
        </div>
      </q-card-section>

      <q-separator color='white' inset />

      <q-card-actions vertical>
        <q-btn flat align="start">
          <q-icon name="group_add" class="tw-mr-4"/>
          <span>Create group</span>
        </q-btn>

        <q-separator inset />

        <q-btn flat align="start">
          <q-icon name="person_add" class="tw-mr-4"/>
          <span>Join group</span>
        </q-btn>
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<script setup>

</script>

<style scoped>
</style>
